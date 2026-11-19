import React, { useState, useEffect } from 'react';
import { useViewer, canListProducts } from '../../lib/viewer';

export const FooterCreatorsNav: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const viewer = useViewer();

  useEffect(() => {
    setMounted(true);
  }, []);

  const canList = mounted && canListProducts(viewer);

  return (
    <nav aria-label="Footer: Independent Creators" className="min-w-0">
      <ul className="space-y-0.5 sm:space-y-1 min-h-[108px] sm:min-h-[116px]">
        {canList ? (
          <>
            <li>
              <a
                href="/seller"
                className="footer-link inline-flex items-center min-h-[36px] min-w-[24px] py-1.5 text-sm leading-[1.6] text-[#F5F0E7]/80 hover:text-[#D9A37B] hover:underline transition-colors"
              >
                Creator Dashboard
              </a>
            </li>
            <li>
              <a
                href="/seller/upload"
                className="footer-link inline-flex items-center min-h-[36px] min-w-[24px] py-1.5 text-sm leading-[1.6] text-[#F5F0E7]/80 hover:text-[#D9A37B] hover:underline transition-colors"
              >
                List a Product
              </a>
            </li>
          </>
        ) : (
          <li>
            <a
              href="/seller"
              className="footer-link inline-flex items-center min-h-[36px] min-w-[24px] py-1.5 text-sm leading-[1.6] text-[#F5F0E7]/80 hover:text-[#D9A37B] hover:underline transition-colors"
            >
              Become a Creator
            </a>
          </li>
        )}
        <li>
          <a
            href="/account"
            className="footer-link inline-flex items-center min-h-[36px] min-w-[24px] py-1.5 text-sm leading-[1.6] text-[#F5F0E7]/80 hover:text-[#D9A37B] hover:underline transition-colors"
          >
            Sign in / Account
          </a>
        </li>
      </ul>
    </nav>
  );
};

export default FooterCreatorsNav;

